#!/usr/bin/perl

use strict;
use warnings;

use Test::More;
use Test::Warn;

use Plack::Builder;

use Plack::Test::Debugger;    
use HTTP::Request::Common qw[ GET ];
use Path::Class           qw[ dir ];
use POSIX                 qw[ strftime ];
use JSON::XS;

BEGIN {
    use_ok('Plack::Debugger');
    use_ok('Plack::Debugger::Storage');

    use_ok('Plack::App::Debugger');
}

# testing stuff ...
my @UUIDS;
my $JSON = JSON::XS->new->utf8->pretty;

# data the Debugger needs
my $DATA_DIR = dir('./t/tmp/');

# cleanup tmp dir
{ -f $_ && $_->remove foreach $DATA_DIR->children( no_hidden => 1 ) }

my $PHASE_TO_DIE_IN = '';

my $debugger = Plack::Debugger->new(
    uid_generator => sub { 
        push @UUIDS => (sprintf '%s-%05d' => (strftime('%F_%T', localtime), scalar @UUIDS));
        $UUIDS[-1];
    },
    storage => Plack::Debugger::Storage->new(
        data_dir     => $DATA_DIR,
        serializer   => sub { $JSON->encode( shift ) },
        deserializer => sub { $JSON->decode( shift ) },
        filename_fmt => "%s.json",
    ),
    panels => [
        Plack::Debugger::Panel->new(
            title     => 'Tester (level 0)',
            before    => sub { 
                my ($self, $env) = @_;
                die 'Died in before' if $PHASE_TO_DIE_IN eq 'before';
                $self->set_result([ 'before' ]);
            },
            after     => sub { 
                my ($self, $env, $resp) = @_;
                die 'Died in after' if $PHASE_TO_DIE_IN eq 'after';
                push @{ $self->get_result } => 'after';
            },
            cleanup   => sub {
                my ($self, $env) = @_;
                die 'Died in cleanup' if $PHASE_TO_DIE_IN eq 'cleanup';
                push @{ $self->get_result } => 'cleanup';
            }
        )
    ]
);

my $app = builder {
    mount '/' => builder {
        enable $debugger->make_collector_middleware;
        sub {
            my $env = shift;
            [ 
                200, 
                [ 'Content-Type' => 'text/html'           ], 
                [ '<html><body>HELLO WORLD</body></html>' ]
            ]
        }
    }
};

test_psgi($app, sub {
        my $cb  = shift;
        {
            my $resp;  
            warning_is { $resp = $cb->(GET '/') } undef, '... no warnings to speak of';
            my $data_file = $DATA_DIR->file( sprintf "%s.json" => $UUIDS[-1] );
            ok(-e $data_file, '... data has been written');
            my $results = $debugger->load_request_results( $UUIDS[-1] );
            is_deeply(
                $results,
                {
                    'request_uid' => $UUIDS[-1],
                    'method'      => 'GET',
                    'uri'         => 'http://localhost/',
                    'timestamp'   => $results->{'timestamp'},
                    'results'     => [
                        {
                            title    => 'Tester (level 0)',   
                            subtitle => '',   
                            result   => [
                                'before',
                                'after',
                                'cleanup'
                            ]
                        }
                    ]
                },
                '... got the expected collected data in the data-dir for error test (' . $PHASE_TO_DIE_IN . ')'
            );
        }   

        $PHASE_TO_DIE_IN = 'before';
        {
            my $resp;  
            warning_like { $resp = $cb->(GET '/') } qr/^Got an exception in during the \`begin\` phase of/, '... got the warnings we expected';  
            my $data_file = $DATA_DIR->file( sprintf "%s.json" => $UUIDS[-1] );
            ok(-e $data_file, '... data has been written');
            my $results = $debugger->load_request_results( $UUIDS[-1] );
            is_deeply(
                $results,
                {
                    'request_uid' => $UUIDS[-1],
                    'method'      => 'GET',
                    'uri'         => 'http://localhost/',
                    'timestamp'   => $results->{'timestamp'},
                    'results'     => [
                        {
                            title    => 'Tester (level 0)',   
                            subtitle => '',   
                            result   => undef
                        }
                    ]
                },
                '... got the expected collected data in the data-dir for error test (' . $PHASE_TO_DIE_IN . ')'
            );
        }

        $PHASE_TO_DIE_IN = 'after';
        {
            my $resp;  
            warning_like { $resp = $cb->(GET '/') } qr/^Got an exception in during the \`after\` phase of/, '... got the warnings we expected';  
            my $data_file = $DATA_DIR->file( sprintf "%s.json" => $UUIDS[-1] );
            ok(-e $data_file, '... data has been written');
            my $results = $debugger->load_request_results( $UUIDS[-1] );
            is_deeply(
                $results,
                {
                    'request_uid' => $UUIDS[-1],
                    'method'      => 'GET',
                    'uri'         => 'http://localhost/',
                    'timestamp'   => $results->{'timestamp'},
                    'results'     => [
                        {
                            title    => 'Tester (level 0)',   
                            subtitle => '',   
                            result   => [
                                'before'
                            ]
                        }
                    ]
                },
                '... got the expected collected data in the data-dir for error test (' . $PHASE_TO_DIE_IN . ')'
            );
        }

        $PHASE_TO_DIE_IN = 'cleanup';
        {
            my $resp;  
            warning_like { $resp = $cb->(GET '/') } qr/^Got an exception in during the \`cleanup\` phase of/, '... got the warnings we expected';  
            my $data_file = $DATA_DIR->file( sprintf "%s.json" => $UUIDS[-1] );
            ok(-e $data_file, '... data has been written');
            my $results = $debugger->load_request_results( $UUIDS[-1] );
            is_deeply(
                $results,
                {
                    'request_uid' => $UUIDS[-1],
                    'method'      => 'GET',
                    'uri'         => 'http://localhost/',
                    'timestamp'   => $results->{'timestamp'},
                    'results'     => [
                        {
                            title    => 'Tester (level 0)',   
                            subtitle => '',   
                            result   => [
                                'before',
                                'after'
                            ]
                        }
                    ]
                },
                '... got the expected collected data in the data-dir for error test (' . $PHASE_TO_DIE_IN . ')'
            );
        }
    }
);

done_testing;







