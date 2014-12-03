#!/usr/bin/perl

use strict;
use warnings;

use Test::More;
use Test::Fatal;

use Plack::Builder;
   
use Plack::Test::Debugger;   
use HTTP::Request::Common qw[ GET ];
use Path::Class           qw[ dir ];
use JSON::XS;

BEGIN {
    use_ok('Plack::Debugger');
    use_ok('Plack::Debugger::Storage');

    use_ok('Plack::App::Debugger');    
}

my $JSON     = JSON::XS->new->utf8->pretty;
my $DATA_DIR = dir('./t/030-tmp-injector/');

# create tmp dir if needed
mkdir $DATA_DIR unless -e $DATA_DIR;

# cleanup tmp dir
{ ((-f $_ && $_->remove) || (-d $_ && $_->rmtree)) foreach $DATA_DIR->children( no_hidden => 1 ) }

my $debugger_application = Plack::App::Debugger->new( 
    debugger => Plack::Debugger->new(
        storage => Plack::Debugger::Storage->new(
            data_dir     => $DATA_DIR,
            serializer   => sub { $JSON->encode( shift ) },
            deserializer => sub { $JSON->decode( shift ) },
            filename_fmt => "%s.json",
        )
    )
);

my $app = builder {
    mount '/' => builder {
        enable $debugger_application->make_injector_middleware;
        enable $debugger_application->debugger->make_collector_middleware;

        # 1xx
        mount '/info' => sub {
            my $env    = shift;
            my $status = $env->{PATH_INFO};
            die "YOU MUST PASS ME A STATUS!" if not $status;
            $status =~ s!^/!!;
            [ $status, [], [] ];
        };

        # 2xx
        mount '/ok' => sub {
            my $env = shift;
            my $status = $env->{PATH_INFO};
            die "YOU MUST PASS ME A STATUS!" if not $status;
            $status =~ s!^/!!;
            [ 
                $status, 
                [ 
                    'Content-Type'   => 'text/html',
                    'Content-Length' => 37
                ], 
                [ '<html><body>HELLO WORLD</body></html>' ]
            ]
        };

        # 3xx
        mount '/redirect' => sub {
            my $env    = shift;
            my $status = $env->{PATH_INFO};
            die "YOU MUST PASS ME A STATUS!" if not $status;
            $status =~ s!^/!!;
            [ $status, [ Location => '/' ], [] ];
        };

        # 4xx-5xx
        mount '/error' => sub {
            my $env    = shift;
            my $status = $env->{PATH_INFO};
            die "YOU MUST PASS ME A STATUS!" if not $status;
            $status =~ s!^/!!;
            [ $status, [], [] ];
        };
    }
};

test_psgi($app, sub {
        my $cb  = shift;

        # test 1xx Info
        foreach my $status ( 100, 101 ) {
            my $resp = $cb->(GET "/info/$status" );  
            is($resp->code, $status, '... got the status (' . $status . ') we expected');
        }

        # Test 2xx success
        foreach my $status ( 200, 201, 203, 205, 206 ) {
            my $resp = $cb->(GET "/ok/$status");  
            is($resp->code, $status, '... got the status (' . $status . ') we expected');
            isnt($resp->headers->header('Content-Length'), 37, '... got the expected expanded Content-Length');
            like(
                $resp->content, 
                qr!^<html><body>HELLO WORLD(.+)</body></html>$!, 
                '... got the right content'
            );
        }

        # Test 204 success & 202 accepted w/ no-content
        foreach my $status ( 202, 204 ) {
            my $resp = $cb->(GET "/ok/$status");  
            is($resp->code, $status, '... got the status (' . $status . ') we expected');
            is($resp->headers->header('Content-Length'), 37, '... got the expected un-expanded Content-Length');
            is(
                $resp->content, 
                '<html><body>HELLO WORLD</body></html>', 
                '... got the right (unmolested) content'
            );
        }

        # Test 3xx redirection
        foreach my $status ( 300 .. 307 ) {
            my $resp = $cb->(GET "/redirect/$status");  
            is($resp->code, $status, '... got the status (' . $status . ') we expected');
        }

        # Test 4xx-5xx errors
        foreach my $status ( 400 .. 417, 500 .. 505 ) {
            my $resp = $cb->(GET "/error/$status");  
            is($resp->code, $status, '... got the status (' . $status . ') we expected');
        }

    }
);

# cleanup tmp dir
{ ((-f $_ && $_->remove) || (-d $_ && $_->rmtree)) foreach $DATA_DIR->children( no_hidden => 1 ) }

done_testing;







