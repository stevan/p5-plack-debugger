#!/usr/bin/perl

use strict;
use warnings;

use Test::More;
use Test::Fatal;

use Plack::Builder;
use Plack::Test;

use Plack::Test::Debugger ();    # this implements the cleanup, we don't want that ...
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
            title     => 'Tester',
            cleanup   => sub {
                my ($self, $env) = @_;
                $self->set_result('cleanup');
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

# now make sure it breaks when 
# cleanup handlers are not available

test_psgi($app, sub {
        my $cb  = shift;

        my $resp = $cb->(GET '/');
        is($resp->code, 500, '... got the error we expected');
        like(
            $resp->content,
            qr/^Cannot use the \<Tester\> debug panel with a \`cleanup\` phase, this Plack env does not support it/,
            '.... got the expected exception'
        );
    }
);

# now make sure it works when 
# cleanup handlers are available
$Plack::Test::Impl = 'MockHTTP::WithCleanupHandlers';

test_psgi($app, sub {
        my $cb  = shift;
        {
            my $resp = $cb->(GET '/');
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
                            title    => 'Tester',   
                            subtitle => '',   
                            result   => 'cleanup'
                        }
                    ]
                },
                '... got the expected collected data in the data-dir for error test'
            );
        }   
    }
);

# cleanup tmp dir
{ ((-f $_ && $_->remove) || (-d $_ && $_->rmtree)) foreach $DATA_DIR->children( no_hidden => 1 ) }

done_testing;







