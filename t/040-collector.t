#!/usr/bin/perl

use strict;
use warnings;

use Test::More;

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
my $DATA_DIR = dir('./t/040-tmp-collector/');

# cleanup tmp dir
{ ((-f $_ && $_->remove) || (-d $_ && $_->rmtree)) foreach $DATA_DIR->children( no_hidden => 1 ) }

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
            title     => 'Tester',
            subtitle  => '... testing all the things',
            before    => sub { 
                my ($self, $env) = @_;
                $self->stash([ 'started request at ' . $env->{'PATH_INFO'} ]); 
            },
            after     => sub { 
                my ($self, $env, $resp) = @_;
                push @{ $self->stash } => 'finished request with status ' . $resp->[0];
            },
            cleanup   => sub {
                my ($self, $env) = @_;
                push @{ $self->stash } => 'cleaning up request';
                $self->set_result( $self->stash ); 
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

            is((scalar grep { /.*\.json$/ } $DATA_DIR->children), 0, '... no data has been written yet');

            my $resp = $cb->(GET '/');  
            is(
                $resp->content, 
                '<html><body>HELLO WORLD</body></html>', 
                '... got the right content (no injector here)'
            );

            my $data_file = $DATA_DIR->file( sprintf "%s.json" => $UUIDS[-1] );

            ok(-e $data_file, '... data has now been written');

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
                            title    => 'Tester',      
                            subtitle => '... testing all the things',
                            result   => [
                                'started request at /',
                                'finished request with status 200',
                                'cleaning up request'
                            ]
                        }
                    ]
                },
                '... got the expected collected data in the data-dir'
            );
        }
    }
);

# cleanup tmp dir
{ ((-f $_ && $_->remove) || (-d $_ && $_->rmtree)) foreach $DATA_DIR->children( no_hidden => 1 ) }

done_testing;







